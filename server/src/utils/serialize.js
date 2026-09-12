export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    familyId: u.family_id,
    role: u.role,
    name: u.name,
    email: u.email,
    username: u.username,
    avatar: u.avatar,
    totalXp: u.total_xp,
  };
}
