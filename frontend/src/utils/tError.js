const ERROR_KEYS = {
  'Invalid credentials':               'invalid_credentials',
  'Username is required':              'username_required',
  'Password too short (12 characters min.)': 'password_too_short',
  'Username already taken':            'username_taken',
  'Invalid password':                  'invalid_password',
  'Name cannot be empty':              'name_empty',
  'Name already in use':               'name_taken',
  'Current password is required':      'current_password_required',
  'Invalid current password':          'current_password_invalid',
  'New password is too short':         'new_password_too_short',
  'Password must be at least 12 characters': 'new_password_too_short',
  'Registration is closed: maximum number of groups reached': 'registration_closed',
  'You already have a group':          'already_have_group',
  'Invalid invite code':               'invalid_invite_code',
  'Group is already full':             'group_full',
  'You cannot join your own group':    'own_group',
  'Unsupported currency':              'unsupported_currency',
  'An error occurred':                 'generic',
}

export function tError(t, msg) {
  if (!msg) return msg
  const key = ERROR_KEYS[msg]
  return key ? t('errors.' + key, msg) : msg
}
