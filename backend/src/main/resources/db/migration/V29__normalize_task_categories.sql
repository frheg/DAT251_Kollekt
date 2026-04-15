alter table tasks
    drop constraint if exists tasks_category_check;

update tasks
set category = upper(category)
where upper(category) in (
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
);

update tasks
set category = 'OTHER'
where category not in (
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
);

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
