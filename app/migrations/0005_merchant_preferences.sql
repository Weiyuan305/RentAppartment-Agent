CREATE TABLE IF NOT EXISTS merchant_preferences (owner TEXT PRIMARY KEY REFERENCES auth_user(id), city TEXT NOT NULL);
