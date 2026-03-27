-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'active', 'archived', 'completed')),
  materials jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rooms table (each project has 1+ rooms)
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null default 'Kitchen',
  room_type text default 'kitchen',
  layout_type text not null,
  input jsonb not null,
  layout jsonb,
  quote jsonb,
  coordinates jsonb,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Revisions table (change order tracking)
create table revisions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  revision_number int not null default 1,
  changes jsonb not null,
  diff jsonb,
  price_delta numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

-- Saved templates (user-customized templates)
create table saved_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  base_template_id text,
  input_overrides jsonb default '{}',
  created_at timestamptz default now()
);

-- RLS policies
alter table projects enable row level security;
alter table rooms enable row level security;
alter table revisions enable row level security;
alter table saved_templates enable row level security;

create policy "Users can CRUD own projects" on projects
  for all using (auth.uid() = user_id);

create policy "Users can CRUD rooms in own projects" on rooms
  for all using (project_id in (select id from projects where user_id = auth.uid()));

create policy "Users can CRUD revisions in own rooms" on revisions
  for all using (room_id in (
    select r.id from rooms r join projects p on r.project_id = p.id where p.user_id = auth.uid()
  ));

create policy "Users can CRUD own templates" on saved_templates
  for all using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();

create trigger rooms_updated_at before update on rooms
  for each row execute function update_updated_at();

-- Indexes
create index idx_projects_user on projects(user_id);
create index idx_rooms_project on rooms(project_id);
create index idx_revisions_room on revisions(room_id);
create index idx_saved_templates_user on saved_templates(user_id);
