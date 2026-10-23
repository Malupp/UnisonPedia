-- UnisonPedia player persistence. Apply once to a NEW, identified Supabase project.
-- This script is transactional. Existing objects with these names cause failure rather than replacement.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create function app_private.player_integer(v jsonb, minimum numeric default 0, maximum numeric default 10000000)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='number' and v::text::numeric between minimum and maximum and trunc(v::text::numeric)=v::text::numeric,false)
$$;
revoke all on function app_private.player_integer(jsonb,numeric,numeric) from public;
grant execute on function app_private.player_integer(jsonb,numeric,numeric) to authenticated;

create function app_private.valid_player_state(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare profile jsonb; c jsonb; b jsonb; s jsonb; g jsonb; v jsonb; ids text[]:='{}'; bids text[]:='{}'; gids text[]:='{}'; assigned text[];
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>5242880 or jsonb_typeof(p->'schemaVersion') is distinct from 'number' or p->>'schemaVersion' is distinct from '2' or (p-array['schemaVersion','profile','copies','builds','goals'])<>'{}'::jsonb then return false;end if;
 profile:=p->'profile';
 if jsonb_typeof(profile) is distinct from 'object' or
   coalesce(profile->>'role','') not in ('damage','defence','support') or coalesce(profile->>'mode','') not in ('pve','pvp') or
   not coalesce(jsonb_typeof(profile->'classId') in ('string','null'),false) or length(profile->>'classId')>200 or
   not app_private.player_integer(profile->'availableGems') or not app_private.player_integer(profile->'reserveGems') or
   jsonb_typeof(profile->'elements') is distinct from 'array' then return false;end if;
 if jsonb_array_length(profile->'elements')>50 then return false;end if;
 for v in select value from jsonb_array_elements(profile->'elements') loop
   if jsonb_typeof(v)<>'string' or length(v#>>'{}')>200 then return false;end if;
 end loop;
 if jsonb_typeof(p->'copies') is distinct from 'array' or jsonb_typeof(p->'builds') is distinct from 'array' or jsonb_typeof(p->'goals') is distinct from 'array' then return false;end if;
 if jsonb_array_length(p->'copies')>20000 or jsonb_array_length(p->'builds')>1000 or jsonb_array_length(p->'goals')>2000 then return false;end if;
 for c in select value from jsonb_array_elements(p->'copies') loop
   if jsonb_typeof(c)<>'object' or jsonb_typeof(c->'copyId') is distinct from 'string' or length(c->>'copyId') not between 1 and 200 or c->>'copyId'=any(ids) or
      jsonb_typeof(c->'itemId') is distinct from 'string' or length(c->>'itemId') not between 1 and 200 or
      not app_private.player_integer(c->'skillLevel',1) or not app_private.player_integer(c->'infusions') or not app_private.player_integer(c->'potential') or
      coalesce(c->>'stat1','') not in ('ATK','MATK','DEF','MDEF') or coalesce(c->>'stat2','') not in ('ATK','MATK','DEF','MDEF') or
      jsonb_typeof(c->'notes') is distinct from 'string' or length(c->>'notes')>10000 then return false;end if;
   ids:=array_append(ids,c->>'copyId');
 end loop;
 for b in select value from jsonb_array_elements(p->'builds') loop
   if jsonb_typeof(b)<>'object' or jsonb_typeof(b->'id') is distinct from 'string' or length(b->>'id') not between 1 and 200 or b->>'id'=any(bids) or
      jsonb_typeof(b->'name') is distinct from 'string' or length(b->>'name')>200 or coalesce(b->>'mode','') not in ('pve','pvp') or
      jsonb_typeof(b->'slots') is distinct from 'array' then return false;end if;
   bids:=array_append(bids,b->>'id');assigned:='{}';
   for s in select value from jsonb_array_elements(b->'slots') loop
     if jsonb_typeof(s)<>'object' or not coalesce(s->>'copyId'=any(ids),false) or s->>'copyId'=any(assigned) or coalesce(s->>'slot','') not in ('main','sub') then return false;end if;
     assigned:=array_append(assigned,s->>'copyId');
   end loop;
 end loop;
 for g in select value from jsonb_array_elements(p->'goals') loop
   if jsonb_typeof(g)<>'object' or jsonb_typeof(g->'id') is distinct from 'string' or length(g->>'id') not between 1 and 500 or g->>'id'=any(gids) or
      coalesce(g->>'kind','') not in ('acquire','potential','element') or jsonb_typeof(g->'label') is distinct from 'string' or length(g->>'label') not between 1 and 500 or
      coalesce(g->>'mode','') not in ('pve','pvp') or not coalesce(jsonb_typeof(g->'classId') in ('string','null'),false) or
      not coalesce(jsonb_typeof(g->'buildId') in ('string','null'),false) or not app_private.player_integer(g->'target',1) or
      jsonb_typeof(g->'itemIds') is distinct from 'array' or coalesce(g->>'status','') not in ('active','archived') or
      jsonb_typeof(g->'metaVersion') is distinct from 'string' or length(g->>'metaVersion')>200 or
      jsonb_typeof(g->'createdAt') is distinct from 'string' or (g->>'createdAt') !~ '^\d{4}-\d{2}-\d{2}T' then return false;end if;
   perform (g->>'createdAt')::timestamptz;
   for v in select value from jsonb_array_elements(g->'itemIds') loop
     if jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 200 then return false;end if;
   end loop;
   if g->>'kind'='acquire' and (jsonb_array_length(g->'itemIds')=0 or g->>'target'<>'1') then return false;end if;
   if g->>'kind'='potential' and (jsonb_typeof(g->'copyId') is distinct from 'string' or length(g->>'copyId') not between 1 and 200) then return false;end if;
   if g->>'kind'='element' and (jsonb_typeof(g->'buildId') is distinct from 'string' or length(g->>'buildId')=0 or coalesce(g->>'gearKind','') not in ('weapon','defence') or coalesce(g->>'element','') not in ('Fire','Water','Wind','Light','Dark','Time','Star')) then return false;end if;
   gids:=array_append(gids,g->>'id');
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then return false;
end $$;
revoke all on function app_private.valid_player_state(jsonb) from public;
grant execute on function app_private.valid_player_state(jsonb) to authenticated;

create table public.player_states (
 user_id uuid primary key references auth.users(id) on delete cascade,
 schema_version integer not null default 2,
 profile jsonb not null, copies jsonb not null, builds jsonb not null, goals jsonb not null,
 revision bigint not null default 1 check(revision between 1 and 9007199254740991),
 updated_at timestamptz not null default clock_timestamp(),
 constraint valid_player_document check(app_private.valid_player_state(jsonb_build_object('schemaVersion',schema_version,'profile',profile,'copies',copies,'builds',builds,'goals',goals)))
);
alter table public.player_states enable row level security;
revoke all on public.player_states from anon, authenticated;
grant select on public.player_states to authenticated;
-- SECURITY INVOKER RPC needs these column privileges. The trigger below rejects direct API writes.
grant insert(user_id,schema_version,profile,copies,builds,goals) on public.player_states to authenticated;
grant update(schema_version,profile,copies,builds,goals) on public.player_states to authenticated;
create policy player_select on public.player_states for select to authenticated using ((select auth.uid())=user_id);
create policy player_insert on public.player_states for insert to authenticated with check ((select auth.uid())=user_id);
create policy player_update on public.player_states for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create function app_private.guard_player_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare expected bigint;
begin
 if nullif(current_setting('app.player_expected_revision',true),'') is null then raise exception 'Use save_player_state' using errcode='42501';end if;
 expected:=current_setting('app.player_expected_revision',true)::bigint;
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Invalid owner' using errcode='42501';end if;
 if tg_op='INSERT' then
   if expected<>0 then raise exception 'Revision conflict' using errcode='40001';end if;
   new.revision:=1;
 else
   if old.revision<>expected then raise exception 'Revision conflict' using errcode='40001';end if;
   new.revision:=old.revision+1;
 end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function app_private.guard_player_write() from public;
create trigger guard_player_state before insert or update on public.player_states for each row execute function app_private.guard_player_write();

create function public.save_player_state(expected_revision bigint,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved public.player_states; owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 if expected_revision is null or expected_revision<0 or expected_revision>=9007199254740991 or not app_private.valid_player_state(payload) then raise exception 'Invalid player state' using errcode='22023';end if;
 perform set_config('app.player_expected_revision',expected_revision::text,true);
 if expected_revision=0 then
   insert into public.player_states(user_id,schema_version,profile,copies,builds,goals)
   values(owner_id,2,payload->'profile',payload->'copies',payload->'builds',payload->'goals')
   on conflict(user_id) do nothing returning * into saved;
 else
   update public.player_states set schema_version=2,profile=payload->'profile',copies=payload->'copies',builds=payload->'builds',goals=payload->'goals'
   where user_id=owner_id and revision=expected_revision returning * into saved;
 end if;
 perform set_config('app.player_expected_revision','',true);
 if saved.user_id is null then raise exception 'Revision conflict' using errcode='40001';end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.save_player_state(bigint,jsonb) from public,anon;
grant execute on function public.save_player_state(bigint,jsonb) to authenticated;
commit;
