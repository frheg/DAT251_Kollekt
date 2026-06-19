create table push_device_tokens (
    token varchar(512) not null primary key,
    member_name varchar(255) not null,
    platform varchar(32) not null,
    updated_at timestamptz not null
);

create index idx_push_device_tokens_member on push_device_tokens (member_name);
