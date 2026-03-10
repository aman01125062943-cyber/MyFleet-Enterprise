-- Create a table for Expense Templates
create table if not exists public.expense_templates (
    id uuid not null primary key default gen_random_uuid(),
    user_id uuid references auth.users not null,
    title text not null,
    amount numeric not null default 0,
    category text not null,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.expense_templates enable row level security;

-- Create policies
create policy "Users can view their own templates"
    on public.expense_templates for select
    using (auth.uid() = user_id);

create policy "Users can insert their own templates"
    on public.expense_templates for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own templates"
    on public.expense_templates for update
    using (auth.uid() = user_id);

create policy "Users can delete their own templates"
    on public.expense_templates for delete
    using (auth.uid() = user_id);
