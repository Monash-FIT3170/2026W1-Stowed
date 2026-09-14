// Accounts stores addresses in `emails.address` and maintains its own unique
// indexes. Older versions of this app added a unique top-level `email` index,
// which treats every Accounts user without that field as the same null value.
export async function removeLegacyUserEmailIndex(rawUsersCollection) {
  let indexes;
  try {
    indexes = await rawUsersCollection.indexes();
  } catch (error) {
    // A fresh database may not have a users collection yet.
    if (error.code === 26 || error.codeName === "NamespaceNotFound") return false;
    throw error;
  }

  const legacyIndex = indexes.find(
    (index) =>
      index.name === "email_1" &&
      index.unique === true &&
      index.key?.email === 1 &&
      Object.keys(index.key).length === 1,
  );
  if (!legacyIndex) return false;

  await rawUsersCollection.dropIndex("email_1");
  return true;
}
