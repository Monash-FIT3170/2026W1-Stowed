import { Meteor } from 'meteor/meteor';

export async function getCallerOrgId(userId) {
  if (!userId) return null;
  const user = await Meteor.users.findOneAsync(userId);
  return user?.profile?.organisationId ?? null;
}

export async function assertOrgAccess(collection, docId, userId) {
  if (!userId) throw new Meteor.Error('not-authorised', 'You must be logged in.');
  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error('no-org', 'Your account is not linked to an organisation.');
  const doc = await collection.findOneAsync(docId);
  if (!doc) throw new Meteor.Error('not-found', 'Document not found.');
  if (doc.orgId !== orgId) throw new Meteor.Error('forbidden', 'Access denied.');
}
