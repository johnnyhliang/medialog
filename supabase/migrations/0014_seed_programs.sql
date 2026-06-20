-- supabase/migrations/0014_seed_programs.sql
insert into programs (name, url, category, company, notes) values
  ('Jane Street FOCUS', 'https://www.janestreet.com/join-jane-street/programs-and-events/focus/', 'internship-track', 'Jane Street', 'apps open ~Oct annually'),
  ('HRT Explore', 'https://www.hudsonrivertrading.com/hrtx/', 'internship-track', 'Hudson River Trading', 'apps open ~Sep annually'),
  ('Citadel Datathon', 'https://www.citadel.com/careers/students/datathons/', 'program', 'Citadel', 'rolling'),
  ('8VC Fellowship', 'https://www.8vc.com/fellowship', 'fellowship', '8VC', 'apps ~Jan/Sep'),
  ('Afore Fellowship', 'https://afore.vc/fellowship', 'fellowship', 'Afore Capital', 'rolling'),
  ('Contrary Capital', 'https://contrarycap.com/talent', 'fellowship', 'Contrary', 'rolling'),
  ('Pear VC Fellowship', 'https://pear.vc/fellowship', 'fellowship', 'Pear VC', 'rolling'),
  ('YC Startup School', 'https://www.startupschool.org/', 'startup', 'Y Combinator', 'rolling cohorts'),
  ('Neo Scholars', 'https://neo.com/scholars', 'program', 'Neo', 'apps ~Sep annually'),
  ('On Deck', 'https://www.beondeck.com/', 'program', 'On Deck', 'rolling cohorts'),
  ('Google Student Researcher', 'https://careers.google.com/jobs/results/?category=RESEARCH&employment_type=INTERN', 'internship-track', 'Google', 'rolling'),
  ('Google STEP Intern', 'https://buildyourfuture.withgoogle.com/programs/step', 'internship-track', 'Google', 'apps ~Oct annually'),
  ('Meta University', 'https://www.metacareers.com/careerprograms/pathways/metauniversity', 'internship-track', 'Meta', 'apps ~Oct annually'),
  ('Microsoft Explore', 'https://careers.microsoft.com/students/us/en/usexploremicrosoftprogram', 'internship-track', 'Microsoft', 'apps ~Oct annually')
on conflict (name) do nothing;
