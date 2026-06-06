begin;

-- Add the two timetable classes that are not yet in the shared class list.
-- This script is safe to run more than once and does not delete timetable data.
insert into public."Class List" (
  "School",
  "Designation",
  "Year Group",
  "Milepost",
  "Level",
  "Class Code",
  "Class Name"
)
select
  'Primary',
  'Bilingual',
  'Year 3',
  'Milepost 2',
  'Primary',
  '3Te',
  '3 Teresa'
where not exists (
  select 1
  from public."Class List"
  where "Class Code" = '3Te'
     or "Class Name" = '3 Teresa'
);

insert into public."Class List" (
  "School",
  "Designation",
  "Year Group",
  "Milepost",
  "Level",
  "Class Code",
  "Class Name"
)
select
  'Primary',
  'Mainstream',
  'Year 4',
  'Milepost 2',
  'Primary',
  '4Hy',
  '4 Hypatia'
where not exists (
  select 1
  from public."Class List"
  where "Class Code" = '4Hy'
     or "Class Name" = '4 Hypatia'
);

with class_updates(class_name, designation, year_group, milepost) as (
  values
    ('3 Malala', 'Bilingual', 'Year 3', 'Milepost 2'),
    ('3 Teresa', 'Bilingual', 'Year 3', 'Milepost 2'),
    ('4 Confucius', 'Bilingual', 'Year 4', 'Milepost 2'),
    ('3 Gandhi', 'Mainstream', 'Year 3', 'Milepost 2'),
    ('3 Mandela', 'Mainstream', 'Year 3', 'Milepost 2'),
    ('4 Anscombe', 'Mainstream', 'Year 4', 'Milepost 2'),
    ('4 Hypatia', 'Mainstream', 'Year 4', 'Milepost 2'),
    ('4 Plato', 'Mainstream', 'Year 4', 'Milepost 2'),
    ('5 Newton', 'Bilingual', 'Year 5', 'Milepost 3'),
    ('6 Hopper', 'Bilingual', 'Year 6', 'Milepost 3'),
    ('5 Curie', 'Mainstream', 'Year 5', 'Milepost 3'),
    ('5 Hodgkin', 'Mainstream', 'Year 5', 'Milepost 3'),
    ('5 Yamanaka', 'Mainstream', 'Year 5', 'Milepost 3'),
    ('6 Jobs', 'Mainstream', 'Year 6', 'Milepost 3'),
    ('6 Bell', 'Mainstream', 'Year 6', 'Milepost 3'),
    ('6 Borlaug', 'Mainstream', 'Year 6', 'Milepost 3'),
    ('6 Galileo', 'Mainstream', 'Year 6', 'Milepost 3'),
    ('6 Prakash', 'Mainstream', 'Year 6', 'Milepost 3')
)
update public."Class List" as classes
set
  "School" = 'Primary',
  "Designation" = class_updates.designation,
  "Year Group" = class_updates.year_group,
  "Milepost" = class_updates.milepost,
  "Level" = 'Primary'
from class_updates
where classes."Class Name" = class_updates.class_name;

-- Keep existing created timetable rows aligned as well.
alter table public.class_timetables
  add column if not exists stream_type text;

update public.class_timetables
set
  stream_type = 'bilingual',
  updated_at = now()
where class_name in (
  '3 Malala',
  '3 Teresa',
  '4 Confucius',
  '5 Newton',
  '6 Hopper'
);

update public.class_timetables
set
  stream_type = 'mainstream',
  updated_at = now()
where class_name in (
  '3 Gandhi',
  '3 Mandela',
  '4 Anscombe',
  '4 Hypatia',
  '4 Plato',
  '5 Curie',
  '5 Hodgkin',
  '5 Yamanaka',
  '6 Jobs',
  '6 Bell',
  '6 Borlaug',
  '6 Galileo',
  '6 Prakash'
);

commit;

select
  "Class Code",
  "Class Name",
  "Designation",
  "Year Group",
  "Milepost",
  "Level"
from public."Class List"
where "Class Name" in (
  '3 Malala',
  '3 Teresa',
  '4 Confucius',
  '3 Gandhi',
  '3 Mandela',
  '4 Anscombe',
  '4 Hypatia',
  '4 Plato',
  '5 Newton',
  '6 Hopper',
  '5 Curie',
  '5 Hodgkin',
  '5 Yamanaka',
  '6 Jobs',
  '6 Bell',
  '6 Borlaug',
  '6 Galileo',
  '6 Prakash'
)
order by
  "Year Group",
  "Designation",
  "Class Name";
