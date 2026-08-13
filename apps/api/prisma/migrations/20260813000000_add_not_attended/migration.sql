-- Add NOT_ATTENDED consultation status so a reservation whose time has passed
-- without any documentation can be treated as "not attended" instead of a
-- finalized no-show, allowing the customer to book a new consultation.
ALTER TYPE "ConsultationStatus" ADD VALUE 'NOT_ATTENDED';