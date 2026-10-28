-- Les pseudos quittés (`released_pseudos`), gardés par la base elle-même, d'un seul tenant avec le
-- changement de pseudo ou la suppression du compte (deux requêtes ensemble ne passent pas entre un
-- contrôle et l'écriture) : un pseudo quitté reste réservé à son compte, qui peut le reprendre ; un
-- autre compte qui le prendrait est refusé. Un compte n'en garde que ses 3 derniers : changer de
-- pseudo sans fin n'en réserve pas autant. `auth.ts` refuse avant eux, avec la bonne raison.

CREATE TRIGGER pseudo_reserved_on_insert BEFORE INSERT ON "user"
WHEN NEW.username IN (SELECT username FROM released_pseudos)
BEGIN SELECT RAISE(ABORT, 'pseudo réservé'); END;
--> statement-breakpoint
CREATE TRIGGER pseudo_reserved_on_update BEFORE UPDATE OF username ON "user"
WHEN EXISTS (SELECT 1 FROM released_pseudos WHERE username = NEW.username AND user_id != NEW.id)
BEGIN SELECT RAISE(ABORT, 'pseudo réservé'); END;
--> statement-breakpoint
CREATE TRIGGER pseudo_released_on_update AFTER UPDATE OF username ON "user"
WHEN OLD.username IS NOT NULL AND OLD.username IS NOT NEW.username
BEGIN
  DELETE FROM released_pseudos WHERE username = NEW.username;
  INSERT OR REPLACE INTO released_pseudos (username, user_id, released_at)
    VALUES (OLD.username, OLD.id, strftime('%Y-%m-%dT%H:%M:%f', 'now'));
  DELETE FROM released_pseudos WHERE user_id = OLD.id AND username NOT IN (
    SELECT username FROM released_pseudos WHERE user_id = OLD.id
    ORDER BY released_at DESC LIMIT 3);
END;
--> statement-breakpoint
CREATE TRIGGER pseudo_released_on_delete AFTER DELETE ON "user"
WHEN OLD.username IS NOT NULL
BEGIN
  INSERT OR REPLACE INTO released_pseudos (username, user_id, released_at)
    VALUES (OLD.username, OLD.id, strftime('%Y-%m-%dT%H:%M:%f', 'now'));
  DELETE FROM released_pseudos WHERE user_id = OLD.id AND username NOT IN (
    SELECT username FROM released_pseudos WHERE user_id = OLD.id
    ORDER BY released_at DESC LIMIT 3);
END;
