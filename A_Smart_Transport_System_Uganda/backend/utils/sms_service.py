def mask_destination(destination):
    value = str(destination or '')
    if len(value) <= 4:
        return value
    return f'{value[:2]}{"*" * max(len(value) - 4, 0)}{value[-2:]}'


def deliver_two_factor_code(user, method, code):
    destination = user.phone if method == 'sms' else user.email
    channel = 'SMS' if method == 'sms' else 'email'
    masked_destination = mask_destination(destination)

    return {
        'channel': channel,
        'destination': destination,
        'masked_destination': masked_destination,
        'message': (
            f'Your ASTS verification code is {code}. '
            f'Demo delivery is enabled for local testing.'
        ),
        'demo_code': code
    }
