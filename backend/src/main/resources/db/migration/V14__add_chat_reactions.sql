alter table chat_messages
    add column reactions text not null default '{}';