alter table members
    add column email varchar(255);

update members
set email = 'member-' || id || '@kollekt.local'
where email is null;

alter table members
    alter column email set not null;

alter table members
    add constraint uq_members_email unique (email);
