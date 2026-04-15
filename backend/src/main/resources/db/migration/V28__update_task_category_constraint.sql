alter table tasks
    drop constraint if exists tasks_category_check;

alter table tasks
    add constraint tasks_category_check
    check (
        category in (
            'CLEANING',
            'VACUUMING',
            'MOPPING',
            'BATHROOM',
            'KITCHEN',
            'LAUNDRY',
            'DISHES',
            'TRASH',
            'DUSTING',
            'WINDOWS',
            'SHOPPING',
            'OTHER'
        )
    );
