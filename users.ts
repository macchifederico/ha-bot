import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const USERS_FILE = join(process.cwd(), "users.json");

export interface User {
  name: string;
  role: "admin" | "user";
  added_at: string;
}

export interface Users {
  [userId: string]: User;
}

export function loadUsers(): Users {
  try {
    const data = readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveUsers(users: Users): void {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function isAuthorized(userId: string): boolean {
  const users = loadUsers();
  return userId in users;
}

export function isAdmin(userId: string): boolean {
  const users = loadUsers();
  return users[userId]?.role === "admin";
}

export function canControlDevices(userId: string): boolean {
  const users = loadUsers();
  const user = users[userId];
  return user?.role === "admin";
}

export function addUser(userId: string, name: string, role: "admin" | "user"): void {
  const users = loadUsers();
  users[userId] = {
    name,
    role,
    added_at: new Date().toISOString(),
  };
  saveUsers(users);
}

export function removeUser(userId: string): void {
  const users = loadUsers();
  delete users[userId];
  saveUsers(users);
}

export function listUsers(): Users {
  return loadUsers();
}