from datetime import timedelta

NATIONAL_HOLIDAYS = {(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (11, 20), (12, 25)}


def fifth_business_day(month):
    """Salary reference includes Saturdays; local holidays are not assumed."""
    day = month.replace(day=1)
    count = 0
    while count < 5:
        if day.weekday() != 6 and (day.month, day.day) not in NATIONAL_HOLIDAYS:
            count += 1
        if count == 5:
            return day
        day += timedelta(days=1)
