do $$
declare
  seed_name text;
  seed_slug text;
begin
  for seed_name, seed_slug in
    values
      ('STUDENT PASTORAL', 'student-pastoral'),
      ('LEARNING SUPPORT', 'learning-support'),
      ('PTMs', 'ptms'),
      ('ENGLISH', 'english'),
      ('READING', 'reading'),
      ('WRITING', 'writing'),
      ('MATHS', 'maths'),
      ('IPC', 'ipc'),
      ('IEYC', 'ieyc'),
      ('PHONICS', 'phonics'),
      ('SCIENCE', 'science'),
      ('SPELLING', 'spelling'),
      ('DESIGN & TECHNOLOGY', 'design-technology'),
      ('MANDARIN WRITING', 'mandarin-writing'),
      ('MANDARIN READING', 'mandarin-reading'),
      ('MANDARIN SPEAKING & LISTENING', 'mandarin-speaking-listening'),
      ('MANDARIN', 'mandarin'),
      ('BM', 'bm'),
      ('P.E.', 'pe'),
      ('MUSIC', 'music'),
      ('STEAM / CODING', 'steam-coding'),
      ('EAL', 'eal'),
      ('MATHS SUPPORT', 'maths-support'),
      ('READING SUPPORT', 'reading-support'),
      ('SEN', 'sen')
  loop
    if exists (
      select 1
      from public.gradebook_subjects
      where slug = seed_slug
        and class_name is null
    ) then
      update public.gradebook_subjects
      set
        name = seed_name,
        is_core = true,
        updated_at = now()
      where slug = seed_slug
        and class_name is null;
    else
      insert into public.gradebook_subjects (
        name,
        slug,
        class_name,
        is_core,
        created_at,
        updated_at
      )
      values (
        seed_name,
        seed_slug,
        null,
        true,
        now(),
        now()
      );
    end if;
  end loop;
end $$;
