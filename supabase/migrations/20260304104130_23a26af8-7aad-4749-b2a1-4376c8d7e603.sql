
-- Agenda items
INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, order_index, day_number) VALUES
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Arrival and Registration', NULL, '09:00', '09:30', 0, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Opening Remarks by Chairperson', NULL, '09:30', '10:00', 1, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Q1 Financial Performance Review', NULL, '10:00', '11:00', 2, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Strategy Update and Investment Priorities', NULL, '11:00', '11:45', 3, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Break', NULL, '11:45', '12:00', 4, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Risk and Governance Review', NULL, '12:00', '13:00', 5, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Board Resolutions and Voting', NULL, '13:00', '13:30', 6, 1),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Closing Lunch', NULL, '13:30', '14:00', 7, 1);

-- Organizers
INSERT INTO public.organizers (event_id, name, email, role) VALUES
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Salma Ben Youssef', 'salma@titanmeet.com', 'Event Director'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Mona Farouk', 'mona.farouk@titanmeetdemo.com', 'Event Coordinator');

-- Speakers
INSERT INTO public.speakers (event_id, name, title) VALUES
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Hassan El-Masry', 'Chairman of the Board'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Laila Fawzy', 'Chief Financial Officer'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Omar Abdelrahman', 'Chief Strategy Officer');

-- Attendees
INSERT INTO public.attendees (event_id, name, email) VALUES
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Karim Adel', 'karim.adel.board@testmail.com'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Reem Salah', 'reem.salah.board@testmail.com'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Ahmed Nassar', 'ahmed.nassar.board@testmail.com'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Dina Hossam', 'dina.hossam.board@testmail.com'),
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'Tarek Youssef', 'tarek.youssef.board@testmail.com');

-- Dress code
INSERT INTO public.dress_codes (event_id, dress_type, day_number, custom_instructions) VALUES
  ('e452ced3-f778-4ed3-b613-3aeb89736257', 'business_formal', 1, 'Business formal attire required for all attendees. Dark suits and professional dress.');

-- Support ticket
INSERT INTO public.support_tickets (user_id, subject, category, priority) VALUES
  ('ba93d198-3c9d-4537-8b97-6f3b6b65cdce', 'Need help configuring board meeting event', 'event_setup', 'medium');
