alter table members
    add column if not exists status varchar(255);

update members
set status = 'ACTIVE'
where status is null;

alter table members
    alter column status set not null;
