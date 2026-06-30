alter table public.setup_preferences
  alter column selected_category_template_ids drop default;

alter table public.setup_preferences
  alter column selected_category_template_ids type text[]
  using selected_category_template_ids::text[];

alter table public.setup_preferences
  alter column selected_category_template_ids set default '{}';
