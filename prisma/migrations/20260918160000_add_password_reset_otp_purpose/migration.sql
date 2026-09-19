-- Add a new OTP purpose for the real password-recovery flow, alongside
-- the existing REGISTER purpose. Adding an enum value only, no data moved.
ALTER TYPE "proposito_otp" ADD VALUE 'PASSWORD_RESET';
