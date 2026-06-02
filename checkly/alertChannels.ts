import { EmailAlertChannel } from 'checkly/constructs';

const sendDefaults = {
  sendFailure: true,
  sendRecovery: true,
  sendDegraded: true,
};

export const emailChannel = new EmailAlertChannel('email-channel-1', {
  address: 'support@mitsailing.com',
  ...sendDefaults,
});
