// El POS usa autenticación local por PIN en el cliente.
// No requiere sesión NextAuth para acceder a las APIs del salón.
export async function requirePosSession() {
  return { session: null };
}
