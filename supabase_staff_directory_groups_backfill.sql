with class_lookup as (
  select
    trim(coalesce("Class Name", '')) as class_name,
    nullif(trim(coalesce("Year Group", '')), '') as year_group_label,
    case
      when lower(trim(coalesce(Milepost, ''))) in ('mp1', 'milepost 1') then 'MP1'
      when lower(trim(coalesce(Milepost, ''))) in ('mp2', 'milepost 2') then 'MP2'
      when lower(trim(coalesce(Milepost, ''))) in ('mp3', 'milepost 3') then 'MP3'
      else nullif(trim(coalesce(Milepost, '')), '')
    end as milepost_label
  from public."Class List"
),
staff_source as (
  select
    s.id,
    s.name,
    s.first_name,
    s.role,
    s.email,
    s.department,
    s.designation,
    s.class,
    s.timetable,
    s.timetable_access_year_group,
    s.team as existing_team,
    s.sub_team as existing_sub_team,
    s.year_group_label as existing_year_group_label,
    s.milepost_label as existing_milepost_label,
    lower(
      concat_ws(
        ' ',
        coalesce(s.name, ''),
        coalesce(s.first_name, ''),
        coalesce(s.role, ''),
        coalesce(s.email, ''),
        coalesce(s.department, ''),
        coalesce(s.designation, ''),
        coalesce(s.class, ''),
        coalesce(s.timetable, ''),
        coalesce(s.timetable_access_year_group, '')
      )
    ) as text_blob,
    cl.year_group_label as class_year_group_label,
    cl.milepost_label as class_milepost_label
  from public.staff as s
  left join class_lookup as cl
    on trim(coalesce(s.class, '')) = cl.class_name
),
derived as (
  select
    id,
    coalesce(
      nullif(trim(existing_year_group_label), ''),
      case
        when text_blob like '%preschool 1%' then 'Preschool 1'
        when text_blob like '%preschool 2%' then 'Preschool 2'
        when text_blob like '%year 1%' then 'Year 1'
        when text_blob like '%year 2%' then 'Year 2'
        when text_blob like '%year 3%' then 'Year 3'
        when text_blob like '%year 4%' then 'Year 4'
        when text_blob like '%year 5%' then 'Year 5'
        when text_blob like '%year 6%' then 'Year 6'
        when lower(trim(coalesce(timetable_access_year_group, ''))) not in ('', 'all timetables')
          then nullif(trim(timetable_access_year_group), '')
        else class_year_group_label
      end
    ) as final_year_group_label,
    coalesce(
      nullif(trim(existing_milepost_label), ''),
      case
        when text_blob ~ '(^|[^a-z0-9])mp1([^a-z0-9]|$)' or text_blob like '%milepost 1%' then 'MP1'
        when text_blob ~ '(^|[^a-z0-9])mp2([^a-z0-9]|$)' or text_blob like '%milepost 2%' then 'MP2'
        when text_blob ~ '(^|[^a-z0-9])mp3([^a-z0-9]|$)' or text_blob like '%milepost 3%' then 'MP3'
        else class_milepost_label
      end
    ) as final_milepost_label,
    text_blob
  from staff_source
),
team_grouped as (
  select
    id,
    final_year_group_label,
    final_milepost_label,
    coalesce(
      nullif(trim(ss.existing_team), ''),
      case
        when d.text_blob like '%principal%'
          or d.text_blob like '%assistant principal%'
          or d.text_blob like '%vice principal%'
          or d.text_blob like '%deputy%'
          or d.text_blob like '%head of primary%'
          or d.text_blob like '%head of school%'
          or d.text_blob like '%headteacher%'
          or d.text_blob like '%senior leadership%'
          or d.text_blob ~ '(^|[^a-z0-9])slt([^a-z0-9]|$)'
          then 'SLT'
        when final_year_group_label in ('Preschool 1', 'Preschool 2') then 'Preschool'
        when final_year_group_label in ('Year 1', 'Year 2') or final_milepost_label = 'MP1' then 'MP1'
        when final_year_group_label in ('Year 3', 'Year 4') or final_milepost_label = 'MP2' then 'MP2'
        when final_year_group_label in ('Year 5', 'Year 6') or final_milepost_label = 'MP3' then 'MP3'
        when d.text_blob like '%music%'
          or d.text_blob like '%mandarin%'
          or d.text_blob like '%bahasa%'
          or d.text_blob ~ '(^|[^a-z0-9])bm([^a-z0-9]|$)'
          or d.text_blob like '%physical education%'
          or d.text_blob like '%p.e.%'
          or d.text_blob like '%library%'
          or d.text_blob like '%coding%'
          or d.text_blob like '%computer science%'
          or d.text_blob like '%steam%'
          or d.text_blob like '%specialist%'
          then 'Specialist'
        else 'Support'
      end
    ) as final_team,
    text_blob,
    ss.existing_team,
    ss.existing_sub_team
  from derived as d
  join staff_source as ss
    on ss.id = d.id
),
grouped as (
  select
    id,
    final_year_group_label,
    final_milepost_label,
    final_team,
    coalesce(
      nullif(trim(existing_sub_team), ''),
      case
        when coalesce(nullif(trim(existing_team), ''), '') ilike 'SLT' then 'Senior Leadership Team'
        when coalesce(nullif(trim(existing_team), ''), '') ilike 'Preschool'
          and final_year_group_label in ('Preschool 1', 'Preschool 2')
          then final_year_group_label
        when coalesce(nullif(trim(existing_team), ''), '') in ('MP1', 'MP2', 'MP3')
          and final_year_group_label is not null
          then final_year_group_label
        when final_year_group_label in ('Preschool 1', 'Preschool 2', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6')
          then final_year_group_label
        when text_blob like '%music%' then 'Music'
        when text_blob like '%mandarin%' then 'Mandarin'
        when text_blob like '%bahasa%' or text_blob ~ '(^|[^a-z0-9])bm([^a-z0-9]|$)' then 'BM'
        when text_blob like '%physical education%' or text_blob like '%p.e.%' then 'P.E.'
        when text_blob like '%library%' then 'Library'
        when text_blob like '%coding%' or text_blob like '%computer science%' then 'Coding'
        when text_blob like '%steam%' then 'STEAM'
        when text_blob like '%maths support%' or text_blob like '%math support%' then 'Maths Support'
        when text_blob like '%remedial reading%' or text_blob like '%reading support%' then 'Remedial Reading'
        when text_blob like '%english as an additional language%' or text_blob ~ '(^|[^a-z0-9])eal([^a-z0-9]|$)' then 'EAL'
        when text_blob like '%senco%' then 'SENCo'
        when text_blob like '%special educational needs%' or text_blob ~ '(^|[^a-z0-9])sen([^a-z0-9]|$)' then 'SEN'
        when text_blob like '%counselling%' or text_blob like '%counseling%' or text_blob like '%counsellor%' or text_blob like '%counselor%' then 'Counselling'
        when text_blob like '%administration%' or text_blob like '% admin %' then 'Administration'
        when final_team = 'Preschool' then 'Preschool Support Teachers'
        when final_team in ('MP1', 'MP2', 'MP3') then 'Support Teachers'
        when final_team = 'Specialist' then 'General Specialist'
        else 'General Support'
      end
    ) as final_sub_team
  from team_grouped
)
update public.staff as s
set
  year_group_label = g.final_year_group_label,
  milepost_label = g.final_milepost_label,
  team = g.final_team,
  sub_team = g.final_sub_team
from grouped as g
where s.id = g.id;
