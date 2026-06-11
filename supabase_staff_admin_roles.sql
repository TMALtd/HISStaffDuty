begin;

update public.staff
set
  system_role = 'admin'
where lower(trim(coalesce(email, ''))) in (
  'benjamin.allen@kl.his.edu.my',
  'daniel.goldspink@kl.his.edu.my'
);

commit;

select
  id,
  name,
  email,
  system_role
from public.staff
where lower(trim(coalesce(email, ''))) in (
  'benjamin.allen@kl.his.edu.my',
  'daniel.goldspink@kl.his.edu.my'
)
order by name;
