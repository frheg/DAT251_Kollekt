alter table chat_messages
    add column if not exists image_data text,
    add column if not exists image_mime_type varchar(120),
    add column if not exists image_file_name varchar(255);
