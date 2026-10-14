/**
 * Crée le compte, le seul (le site n'a pas d'inscription), ou change son mot de passe.
 *
 *   bun server/create-user.ts <e-mail>
 *   sur le VPS : docker compose run --rm server bun server/create-user.ts <e-mail>
 *
 * Le mot de passe est demandé deux fois au clavier, sans s'afficher ; ou lu sur l'entrée standard
 * (`… | bun server/create-user.ts <e-mail>`) : jamais en argument, il resterait dans l'historique
 * du terminal. Le changer ferme les sessions ouvertes sur tous les appareils.
 */

import { createAuth } from './auth'
import { openApp } from './db'

/** Une ligne tapée sans s'afficher ; la première ligne de l'entrée standard sans terminal. */
async function readSecret(question: string): Promise<string> {
  process.stdout.write(question)
  if (!process.stdin.isTTY) return (await Bun.stdin.text()).split(/\r?\n/)[0] ?? ''
  process.stdin.setRawMode(true)
  let value = ''
  for await (const chunk of process.stdin) {
    for (const char of String(chunk)) {
      if (char === '\u0003') process.exit(130)
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        return value
      }
      value = char === '\u007f' || char === '\b' ? value.slice(0, -1) : value + char
    }
  }
  return value
}

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage : bun server/create-user.ts <e-mail>')
  process.exit(1)
}

const auth = await createAuth(openApp(), { signUp: true })
const context = await auth.$context
const { minPasswordLength, maxPasswordLength } = context.password.config

const password = await readSecret('Mot de passe : ')
if (process.stdin.isTTY && password !== (await readSecret('Encore une fois : '))) {
  console.error('Les deux mots de passe diffèrent.')
  process.exit(1)
}
if (password.length < minPasswordLength || password.length > maxPasswordLength) {
  console.error(`De ${minPasswordLength} à ${maxPasswordLength} caractères.`)
  process.exit(1)
}

const found = await context.internalAdapter.findUserByEmail(email)
if (found) {
  await context.internalAdapter.updatePassword(found.user.id, await context.password.hash(password))
  await context.internalAdapter.deleteUserSessions(found.user.id)
  console.log(`Mot de passe de ${email} changé ; ses sessions sont fermées.`)
} else {
  await auth.api.signUpEmail({ body: { email, password, name: email.split('@')[0]! } })
  console.log(`Compte ${email} créé.`)
}
