package main

import (
	"context"
	"net/http"
	"time"

	"go.mau.fi/whatsmeow/types"
)

// ImportResult reports how many new groups/contacts an import run added, so
// the UI can show a summary toast. Entries that already have a chat_meta row
// (i.e. already appear in the Contatos/Grupos tabs) are left untouched —
// status, assignment and queue routing of an ongoing conversation are never
// overwritten by an import.
type ImportResult struct {
	GroupsImported   int `json:"groupsImported"`
	ContactsImported int `json:"contactsImported"`
}

// handleImportContacts pulls every group the connection currently
// participates in and every contact saved in that WhatsApp account's address
// book, creating a chat_meta row for each one that isn't already known. This
// surfaces groups/contacts that never exchanged a message through WaCalls —
// the whole point being that an operator can find and message them without
// touching WhatsApp Desktop.
func (s *server) handleImportContacts(w http.ResponseWriter, r *http.Request) {
	sess := s.sessionByID(w, r, r.PathValue("sid"))
	if sess == nil {
		return
	}
	if sess.client == nil || sess.client.Store == nil || sess.client.Store.ID == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "conexão não pareada"})
		return
	}
	if s.chatMeta == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "chat store indisponível"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	existing, err := s.chatMeta.ListBySession(ctx, sess.id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	var res ImportResult

	if groups, err := sess.client.GetJoinedGroups(ctx); err != nil {
		s.log.Warn("import groups failed", "session", sess.id, "err", err)
	} else {
		for _, g := range groups {
			jid := g.JID.String()
			if _, ok := existing[jid]; ok {
				continue
			}
			name := g.Name
			if name == "" {
				name = jid
			}
			m := ChatMeta{
				SessionID: sess.id, ChatJID: jid, Name: name,
				IsGroup: true, Status: ChatStatusGroup, UpdatedAt: time.Now().UnixMilli(),
			}
			if err := s.chatMeta.Upsert(ctx, m); err != nil {
				s.log.Warn("import group upsert failed", "jid", jid, "err", err)
				continue
			}
			existing[jid] = m
			s.broker.emitChatMeta(m)
			res.GroupsImported++
		}
	}

	if contacts, err := sess.client.Store.Contacts.GetAllContacts(ctx); err != nil {
		s.log.Warn("import contacts failed", "session", sess.id, "err", err)
	} else {
		for jid, ci := range contacts {
			// Address book only — skip @lid shadow entries (no stable phone
			// number to message) and anything that isn't a person.
			if jid.Server != types.DefaultUserServer {
				continue
			}
			jidStr := jid.String()
			if _, ok := existing[jidStr]; ok {
				continue
			}
			name := ci.FullName
			if name == "" {
				name = ci.PushName
			}
			if name == "" {
				name = ci.BusinessName
			}
			if name == "" {
				name = ci.FirstName
			}
			if name == "" {
				// No usable name — importing a bare number isn't useful and
				// can't be told apart from junk entries in the store.
				continue
			}
			m := ChatMeta{
				SessionID: sess.id, ChatJID: jidStr, Name: name,
				IsGroup: false, Status: ChatStatusWaiting, UpdatedAt: time.Now().UnixMilli(),
			}
			if err := s.chatMeta.Upsert(ctx, m); err != nil {
				s.log.Warn("import contact upsert failed", "jid", jidStr, "err", err)
				continue
			}
			existing[jidStr] = m
			s.broker.emitChatMeta(m)
			res.ContactsImported++
		}
	}

	writeJSON(w, http.StatusOK, res)
}
