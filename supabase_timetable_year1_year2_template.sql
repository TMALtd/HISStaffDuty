do $$
declare
  v_template_id uuid;
begin
  select id
  into v_template_id
  from public.timetable_templates
  where name = 'Year 1 / Year 2 Standard'
  limit 1;

  if v_template_id is null then
    insert into public.timetable_templates (
      name,
      school,
      designation,
      year_group,
      is_active
    )
    values (
      'Year 1 / Year 2 Standard',
      'Primary',
      'Primary',
      'Year 1 / Year 2',
      true
    )
    returning id into v_template_id;
  else
    update public.timetable_templates
    set
      school = 'Primary',
      designation = 'Primary',
      year_group = 'Year 1 / Year 2',
      is_active = true,
      updated_at = now()
    where id = v_template_id;

    delete from public.timetable_periods
    where template_id = v_template_id;
  end if;

  insert into public.timetable_periods (
    template_id,
    weekday,
    label,
    start_time,
    end_time,
    block_type,
    sort_order
  )
  select
    v_template_id,
    weekday_list.weekday,
    period_list.label,
    period_list.start_time,
    period_list.end_time,
    period_list.block_type,
    period_list.sort_order
  from (
    values
      ('monday'),
      ('wednesday'),
      ('thursday')
  ) as weekday_list(weekday)
  cross join (
    values
      ('Pastoral Time', '07:30'::time, '08:00'::time, 'other', 1),
      ('Lesson 1', '08:00'::time, '08:40'::time, 'lesson', 2),
      ('Lesson 2', '08:40'::time, '09:20'::time, 'lesson', 3),
      ('Breaktime', '09:20'::time, '09:40'::time, 'break', 4),
      ('Lesson 3', '09:40'::time, '10:20'::time, 'lesson', 5),
      ('Lesson 4', '10:20'::time, '11:00'::time, 'lesson', 6),
      ('Lesson 5', '11:00'::time, '11:40'::time, 'lesson', 7),
      ('Lunchtime', '11:40'::time, '12:20'::time, 'lunch', 8),
      ('Lesson 6', '12:20'::time, '13:00'::time, 'lesson', 9),
      ('Lesson 7', '13:00'::time, '13:40'::time, 'lesson', 10),
      ('Lesson 8', '13:40'::time, '14:20'::time, 'lesson', 11),
      ('Pastoral', '14:20'::time, '14:30'::time, 'other', 12),
      ('Dismissal', '14:30'::time, '14:45'::time, 'dismissal', 13)
  ) as period_list(label, start_time, end_time, block_type, sort_order);

  insert into public.timetable_periods (
    template_id,
    weekday,
    label,
    start_time,
    end_time,
    block_type,
    sort_order
  )
  select
    v_template_id,
    'tuesday',
    period_list.label,
    period_list.start_time,
    period_list.end_time,
    period_list.block_type,
    period_list.sort_order
  from (
    values
      ('Pastoral Time', '07:30'::time, '08:00'::time, 'other', 1),
      ('Lesson 1', '08:00'::time, '08:40'::time, 'lesson', 2),
      ('Lesson 2', '08:40'::time, '09:20'::time, 'lesson', 3),
      ('Breaktime', '09:20'::time, '09:40'::time, 'break', 4),
      ('Lesson 3', '09:40'::time, '10:20'::time, 'lesson', 5),
      ('Lesson 4', '10:20'::time, '11:00'::time, 'lesson', 6),
      ('Lesson 5', '11:00'::time, '11:40'::time, 'lesson', 7),
      ('Lunchtime', '11:40'::time, '12:20'::time, 'lunch', 8),
      ('Lesson 6', '12:20'::time, '13:00'::time, 'lesson', 9),
      ('Lesson 7', '13:00'::time, '13:40'::time, 'lesson', 10),
      ('Lesson 8', '13:40'::time, '14:20'::time, 'lesson', 11),
      ('Lesson 9', '14:20'::time, '15:00'::time, 'lesson', 12),
      ('CCA Breaktime', '15:00'::time, '15:15'::time, 'break', 13),
      ('CCA', '15:15'::time, '16:10'::time, 'other', 14),
      ('CCA Dismissal', '16:10'::time, '16:30'::time, 'dismissal', 15)
  ) as period_list(label, start_time, end_time, block_type, sort_order);

  insert into public.timetable_periods (
    template_id,
    weekday,
    label,
    start_time,
    end_time,
    block_type,
    sort_order
  )
  select
    v_template_id,
    'friday',
    period_list.label,
    period_list.start_time,
    period_list.end_time,
    period_list.block_type,
    period_list.sort_order
  from (
    values
      ('Pastoral Time', '07:30'::time, '08:00'::time, 'other', 1),
      ('Lesson 1', '08:00'::time, '08:40'::time, 'lesson', 2),
      ('Lesson 2', '08:40'::time, '09:20'::time, 'lesson', 3),
      ('Breaktime', '09:20'::time, '09:40'::time, 'break', 4),
      ('Lesson 3', '09:40'::time, '10:20'::time, 'lesson', 5),
      ('Lesson 4', '10:20'::time, '11:00'::time, 'lesson', 6),
      ('Lesson 5', '11:00'::time, '11:40'::time, 'lesson', 7),
      ('Pastoral Time', '11:40'::time, '12:00'::time, 'other', 8),
      ('Dismissal', '12:00'::time, '12:15'::time, 'dismissal', 9)
  ) as period_list(label, start_time, end_time, block_type, sort_order);
end $$;
