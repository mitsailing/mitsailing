import * as React from 'react';

/** When true, {@link SubmitButton} stops treating the form as pending so users can retry. */
export const FormSubmitTimeoutContext = React.createContext(false);
