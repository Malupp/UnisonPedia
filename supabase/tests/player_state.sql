-- Run after bootstrap.sql + schema.sql on disposable local Postgres only. Everything rolls back.
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
do $$
declare p jsonb:='{"schemaVersion":2,"profile":{"classId":"Mage","role":"damage","mode":"pve","elements":[],"availableGems":42,"reserveGems":0},"copies":[{"copyId":"c","itemId":"unknown-id","skillLevel":1,"infusions":0,"potential":0,"stat1":"ATK","stat2":"MATK","notes":""}],"builds":[{"id":"b","name":"Build","mode":"pve","slots":[{"copyId":"c","slot":"main"}]}],"goals":[]}'::jsonb; r jsonb; n integer;
begin
 r:=public.save_player_state(0,p);if (r->>'revision')::integer<>1 or r->'profile'->>'availableGems'<>'42' then raise exception 'First save failed';end if;
 r:=public.save_player_state(1,p);if (r->>'revision')::integer<>2 then raise exception 'Revision increment failed';end if;
 begin perform public.save_player_state(1,p);raise exception 'Stale write accepted';exception when serialization_failure then null;end;
 begin perform public.save_player_state(0,p);raise exception 'Duplicate initial save accepted';exception when serialization_failure then null;end;
 begin perform public.save_player_state(2,jsonb_set(p,'{profile,availableGems}','-1'));raise exception 'Negative gems accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_player_state(2,jsonb_set(p,'{builds,0,slots,0,copyId}','"missing"'));raise exception 'Dangling slot accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_player_state(2,jsonb_set(p,'{copies,1}',p->'copies'->0));raise exception 'Duplicate copy accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_player_state(2,jsonb_set(p,'{goals}','[{"id":"bad"}]'));raise exception 'Invalid goal accepted';exception when invalid_parameter_value then null;end;
 begin update public.player_states set profile=p->'profile';raise exception 'Direct write accepted';exception when insufficient_privilege then null;end;
 begin update public.player_states set user_id='22222222-2222-2222-2222-222222222222';raise exception 'Owner changed';exception when insufficient_privilege then null;end;
 select count(*) into n from public.player_states;if n<>1 then raise exception 'Owner select failed';end if;
end $$;
set local request.jwt.claim.sub='22222222-2222-2222-2222-222222222222';
do $$ declare n integer;begin select count(*) into n from public.player_states;if n<>0 then raise exception 'Other user could read inventory';end if;end $$;
set local role anon;
do $$ begin
 begin perform * from public.player_states;raise exception 'Anonymous read accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_player_state(0,'{}'::jsonb);raise exception 'Anonymous save accepted';exception when insufficient_privilege then null;end;
end $$;
rollback;
