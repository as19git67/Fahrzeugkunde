import { pgTable, serial, text, integer, doublePrecision, boolean, timestamp } from "drizzle-orm/pg-core";

// --- Fahrzeuge ---
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// --- Fahrzeugseiten (links, rechts, hinten, oben) ---
export const vehicleViews = pgTable("vehicle_views", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  side: text("side").notNull(), // 'left','right','back','top','front'
  label: text("label").notNull(),
  imagePath: text("image_path"),
  sortOrder: integer("sort_order").default(0),
});

// --- Rolladen / Fächer (G1, G2, ...) ---
export const compartments = pgTable("compartments", {
  id: serial("id").primaryKey(),
  viewId: integer("view_id").notNull().references(() => vehicleViews.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  imagePath: text("image_path"),
  hotspotX: doublePrecision("hotspot_x"),
  hotspotY: doublePrecision("hotspot_y"),
  hotspotW: doublePrecision("hotspot_w"),
  hotspotH: doublePrecision("hotspot_h"),
  sortOrder: integer("sort_order").default(0),
});

// --- Positionen innerhalb eines Fachs (oben/mitte/unten/links/rechts/...) ---
export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  compartmentId: integer("compartment_id").notNull().references(() => compartments.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  hotspotX: doublePrecision("hotspot_x"),
  hotspotY: doublePrecision("hotspot_y"),
  hotspotW: doublePrecision("hotspot_w"),
  hotspotH: doublePrecision("hotspot_h"),
  sortOrder: integer("sort_order").default(0),
});

// --- Kisten innerhalb einer Position (optional) ---
export const boxes = pgTable("boxes", {
  id: serial("id").primaryKey(),
  positionId: integer("position_id").notNull().references(() => positions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  imagePath: text("image_path"),
  hotspotX: doublePrecision("hotspot_x"),
  hotspotY: doublePrecision("hotspot_y"),
  hotspotW: doublePrecision("hotspot_w"),
  hotspotH: doublePrecision("hotspot_h"),
  sortOrder: integer("sort_order").default(0),
});

// --- Ausrüstungsgegenstände ---
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Grammatischer Artikel (der/die/das) — steuert die Anrede in der UI
  article: text("article"),
  description: text("description"),
  imagePath: text("image_path"),
  silhouettePath: text("silhouette_path"),
  category: text("category"),
  difficulty: integer("difficulty").default(1),
  positionId: integer("position_id").references(() => positions.id, { onDelete: "cascade" }),
  boxId: integer("box_id").references(() => boxes.id, { onDelete: "cascade" }),
  locationLabel: text("location_label"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// --- Benutzer ---
// `role` unterscheidet normale Nutzer von Administratoren. Der erste
// jemals registrierte User wird beim Anlegen automatisch auf 'admin'
// hochgestuft (siehe `createOrGetUser`); alle weiteren Logins bekommen
// den Default 'user'. Nur Admins dürfen die DB zurücksetzen und
// Fahrzeug-Pakete importieren/exportieren.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  email: text("email").notNull().unique(),
  verified: boolean("verified").default(false),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// --- Auth-Codes (Email-Code Login) ---
export const authCodes = pgTable("auth_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// --- Sessions ---
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// --- Highscores ---
export const highscores = pgTable("highscores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  handle: text("handle").notNull(),
  score: integer("score").notNull(),
  mode: text("mode").notNull(), // 'time_attack', 'speed_run'
  correctAnswers: integer("correct_answers").notNull(),
  totalAnswers: integer("total_answers").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});
