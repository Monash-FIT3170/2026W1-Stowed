import { ROLES } from "../roles";

export const FAKE_ACCOUNT_SEEDS = [
  { username: "jsmith", email: "jsmith@monash.edu", password: "monash123", role: ROLES.ADMIN },
  { username: "mchen", email: "mchen@monash.edu", password: "monash123", role: ROLES.STANDARD },
  {
    username: "arahman",
    email: "arahman@monash.edu",
    password: "monash123",
    role: ROLES.STANDARD,
  },
  { username: "ktaylor", email: "ktaylor@monash.edu", password: "monash123", role: ROLES.ADMIN },
  {
    username: "lwilliams",
    email: "lwilliams@monash.edu",
    password: "monash123",
    role: ROLES.STANDARD,
  },
];
