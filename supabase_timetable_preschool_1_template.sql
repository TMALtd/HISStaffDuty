do $$
declare
  v_template_id uuid;
begin
  select id
  into v_template_id
  from public.timetable_templates
  where name = 'Preschool 1 Standard'
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
      'Preschool 1 Standard',
      'Preschool',
      'Preschool',
      'Preschool 1',
      true
    )
    returning id into v_template_id;
  else
    update public.timetable_templates
    set
      school = 'Preschool',
      designation = 'Preschool',
      year_group = 'Preschool 1',
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
    'monday',
    period_list.label,
    period_list.start_time,
    period_list.end_time,
    period_list.block_type,
    period_list.sort_order
  from (
    values
      ('Lesson 1', '08:00'::time, '08:30'::time, 'lesson', 1),
      ('Lesson 2', '08:30'::time, '09:00'::time, 'lesson', 2),
      ('Lesson 3', '09:00'::time, '09:30'::time, 'lesson', 3),
      ('Breaktime', '09:30'::time, '10:00'::time, 'break', 4),
      ('Lesson 4', '10:00'::time, '11:00'::time, 'lesson', 5),
      ('Lesson 5', '11:00'::time, '11:30'::time, 'lesson', 6),
      ('Lesson 6', '11:30'::time, '12:00'::time, 'lesson', 7),
      ('Lunchtime', '12:00'::time, '12:40'::time, 'lunch', 8),
      ('Mindfulness', '12:40'::time, '12:50'::time, 'other', 9),
      ('Lesson 7', '12:50'::time, '13:50'::time, 'lesson', 10),
      ('Pack Up', '13:50'::time, '14:00'::time, 'other', 11),
      ('Dismissal', '14:00'::time, '14:15'::time, 'dismissal', 12)
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
    weekday_list.weekday,
    period_list.label,
    period_list.start_time,
    period_list.end_time,
    period_list.block_type,
    period_list.sort_order
  from (
    values
      ('tuesday'),
      ('wednesday')
  ) as weekday_list(weekday)
  cross join (
    values
      ('Lesson 1', '08:00'::time, '08:45'::time, 'lesson', 1),
      ('Lesson 2', '08:45'::time, '09:30'::time, 'lesson', 2),
      ('Breaktime', '09:30'::time, '10:00'::time, 'break', 3),
      ('Lesson 3', '10:00'::time, '11:00'::time, 'lesson', 4),
      ('Lesson 4', '11:00'::time, '11:30'::time, 'lesson', 5),
      ('Lesson 5', '11:30'::time, '12:00'::time, 'lesson', 6),
      ('Lunchtime', '12:00'::time, '12:40'::time, 'lunch', 7),
      ('Mindfulness', '12:40'::time, '12:50'::time, 'other', 8),
      ('Lesson 6', '12:50'::time, '13:50'::time, 'lesson', 9),
      ('Pack Up', '13:50'::time, '14:00'::time, 'other', 10),
      ('Dismissal', '14:00'::time, '14:15'::time, 'dismissal', 11)
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
    'thursday',
    period_list.label,
    period_list.start_time,
    period_list.end_time,
    period_list.block_type,
    period_list.sort_order
  from (
    values
      ('Lesson 1', '08:00'::time, '08:30'::time, 'lesson', 1),
      ('Lesson 2', '08:30'::time, '09:00'::time, 'lesson', 2),
      ('Lesson 3', '09:00'::time, '09:30'::time, 'lesson', 3),
      ('Breaktime', '09:30'::time, '10:00'::time, 'break', 4),
      ('Lesson 4', '10:00'::time, '11:00'::time, 'lesson', 5),
      ('Lesson 5', '11:00'::time, '11:30'::time, 'lesson', 6),
      ('Lesson 6', '11:30'::time, '12:00'::time, 'lesson', 7),
      ('Lunchtime', '12:00'::time, '12:40'::time, 'lunch', 8),
      ('Mindfulness', '12:40'::time, '12:50'::time, 'other', 9),
      ('Lesson 7', '12:50'::time, '13:50'::time, 'lesson', 10),
      ('Pack Up', '13:50'::time, '14:00'::time, 'other', 11),
      ('Dismissal', '14:00'::time, '14:15'::time, 'dismissal', 12)
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
      ('Assembly', '08:00'::time, '08:30'::time, 'assembly', 1),
      ('Lesson 1', '08:30'::time, '09:30'::time, 'lesson', 2),
      ('Breaktime', '09:30'::time, '10:00'::time, 'break', 3),
      ('Lesson 2', '10:00'::time, '11:00'::time, 'lesson', 4),
      ('Lesson 3', '11:00'::time, '11:30'::time, 'lesson', 5),
      ('Lesson 4', '11:30'::time, '12:00'::time, 'lesson', 6),
      ('Dismissal', '12:00'::time, '12:15'::time, 'dismissal', 7)
  ) as period_list(label, start_time, end_time, block_type, sort_order);
end $$;
