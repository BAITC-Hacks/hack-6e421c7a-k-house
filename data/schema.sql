-- TaskBridge AI: схема для следующего этапа.
-- Сейчас интерактивный прототип использует localStorage.
-- Эта SQLite-совместимая схема позволит позже заменить его без изменения модели данных.

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  context TEXT NOT NULL,
  users_description TEXT,
  data_materials TEXT,
  expected_result TEXT,
  success_criteria TEXT,
  constraints_description TEXT,
  contact_format TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100),
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  interests TEXT,
  skills TEXT,
  technologies TEXT
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  idea TEXT NOT NULL,
  plan TEXT,
  deadline TEXT,
  prototype_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Рейтинг вычисляется приложением прозрачно:
-- context 20 + data 20 + result 15 + success 15 +
-- constraints 10 + users 10 + contact 10.
