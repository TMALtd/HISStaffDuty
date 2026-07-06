drop view if exists public.student_class_roster;
drop view if exists public.student_class_roster_legacy;

create view public.student_class_roster_legacy as
select
  c."Class Code" as class_code,
  c."Class Name" as class_name,
  c."School" as school,
  c."Designation" as designation,
  c."Year Group" as year_group,
  c."Milepost" as milepost,
  c."Level" as level,
  t."School Id"::text as school_id,
  t."Full Name" as full_name,
  null::text as surname,
  null::text as first_name,
  t."Preferred Name" as preferred_name,
  t."Gender" as gender,
  t."Nationality" as nationality,
  t."Academic House" as academic_house
from public."Term 3 Data" t
join public."Class List" c
  on c."Class Name" = t."Form";

create view public.student_class_roster as
with active_year as (
  select id
  from public.student_academic_years
  where is_active = true
  order by updated_at desc, created_at desc
  limit 1
)
select
  e.class_code,
  e.class_name,
  e.school,
  e.designation,
  e.year_group,
  e.milepost,
  e.level,
  e.school_id,
  e.full_name,
  e.surname,
  e.first_name,
  e.preferred_name,
  e.gender,
  e.nationality,
  e.academic_house
from public.student_roster_entries e
join active_year a
  on a.id = e.academic_year_id

union all

select
  legacy.class_code,
  legacy.class_name,
  legacy.school,
  legacy.designation,
  legacy.year_group,
  legacy.milepost,
  legacy.level,
  legacy.school_id::text as school_id,
  legacy.full_name,
  legacy.surname,
  legacy.first_name,
  legacy.preferred_name,
  legacy.gender,
  legacy.nationality,
  legacy.academic_house
from public.student_class_roster_legacy legacy
where not exists (select 1 from active_year);
