create or replace view public.student_class_roster as
select
  c."Class Code" as class_code,
  c."Class Name" as class_name,
  c."School" as school,
  c."Designation" as designation,
  c."Year Group" as year_group,
  c."Milepost" as milepost,
  c."Level" as level,
  t."School Id" as school_id,
  t."Full Name" as full_name,
  t."Preferred Name" as preferred_name,
  t."Gender" as gender,
  t."Form" as form,
  t."Year Code" as year_code,
  t."Tutor" as tutor,
  t."Academic House" as academic_house
from public."Term 3 Data" t
join public."Class List" c
  on c."Class Name" = t."Form";

comment on view public.student_class_roster is
'Joined roster view for the staff filter portal on Render.';
