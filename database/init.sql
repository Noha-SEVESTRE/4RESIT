CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       email VARCHAR(255) NOT NULL UNIQUE,
                       password_hash VARCHAR(255),
                       display_name VARCHAR(120) NOT NULL,
                       dietary_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
                       default_portions INTEGER NOT NULL DEFAULT 2,
                       failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                       locked_until TIMESTAMP,
                       created_at TIMESTAMP NOT NULL DEFAULT now(),
                       updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE oauth_accounts (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                provider VARCHAR(50) NOT NULL,
                                provider_user_id VARCHAR(255) NOT NULL,
                                created_at TIMESTAMP NOT NULL DEFAULT now(),
                                UNIQUE(provider, provider_user_id)
);

CREATE TABLE cookbooks (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           name VARCHAR(120) NOT NULL,
                           description TEXT,
                           created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                           created_at TIMESTAMP NOT NULL DEFAULT now(),
                           updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE cookbook_members (
                                  cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
                                  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                  role VARCHAR(30) NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'READER', 'COMMENTATOR')),
                                  created_at TIMESTAMP NOT NULL DEFAULT now(),
                                  PRIMARY KEY (cookbook_id, user_id)
);

CREATE TABLE recipes (
                         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                         cookbook_id UUID REFERENCES cookbooks(id) ON DELETE CASCADE,
                         title VARCHAR(180) NOT NULL,
                         description TEXT,
                         preparation_time INTEGER NOT NULL DEFAULT 0,
                         cooking_time INTEGER NOT NULL DEFAULT 0,
                         portions INTEGER NOT NULL DEFAULT 2,
                         image_url TEXT,
                         source TEXT,
                         created_at TIMESTAMP NOT NULL DEFAULT now(),
                         updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE recipe_ingredients (
                                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                                    name VARCHAR(160) NOT NULL,
                                    quantity VARCHAR(80),
                                    unit VARCHAR(60),
                                    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recipe_steps (
                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                              instruction TEXT NOT NULL,
                              position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recipe_tags (
                             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                             recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                             name VARCHAR(80) NOT NULL
);

CREATE TABLE recipe_favorites (
                                  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                                  created_at TIMESTAMP NOT NULL DEFAULT now(),
                                  PRIMARY KEY (user_id, recipe_id)
);

CREATE TABLE meal_plans (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            cookbook_id UUID REFERENCES cookbooks(id) ON DELETE CASCADE,
                            recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                            planned_date DATE NOT NULL,
                            meal_type VARCHAR(40) NOT NULL,
                            created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE recipe_comments (
                                 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                                 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                 content TEXT NOT NULL,
                                 created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE cookbook_messages (
                                   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                   cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
                                   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                   content TEXT NOT NULL,
                                   created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_owner_id ON recipes(owner_id);
CREATE INDEX idx_recipes_cookbook_id ON recipes(cookbook_id);
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipe_ingredients_name ON recipe_ingredients(name);
CREATE INDEX idx_recipe_tags_name ON recipe_tags(name);
CREATE INDEX idx_meal_plans_user_date ON meal_plans(user_id, planned_date);
CREATE INDEX idx_recipe_comments_recipe_id ON recipe_comments(recipe_id);
CREATE INDEX idx_cookbook_messages_cookbook_id ON cookbook_messages(cookbook_id);

CREATE INDEX idx_recipes_title_trgm
    ON recipes USING gin (title gin_trgm_ops);

CREATE INDEX idx_recipes_description_trgm
    ON recipes USING gin (description gin_trgm_ops);

CREATE INDEX idx_recipe_ingredients_name_trgm
    ON recipe_ingredients USING gin (name gin_trgm_ops);

CREATE INDEX idx_recipe_tags_name_trgm
    ON recipe_tags USING gin (name gin_trgm_ops);

CREATE INDEX idx_recipe_steps_instruction_trgm
    ON recipe_steps USING gin (instruction gin_trgm_ops);