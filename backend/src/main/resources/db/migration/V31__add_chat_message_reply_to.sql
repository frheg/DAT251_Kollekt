alter table chat_messages
    add column if not exists reply_to_message_id bigint;
