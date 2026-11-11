# Resume templates

Drop `.doc` / `.docx` files here. ResumeForge scans this folder on API start and whenever formats are listed, then shows them in **Resume format** on the admin profile form.

## Included samples

| File | Use |
|------|-----|
| `Classic.docx` | Clean single-column layout |
| `Modern.docx` | Contemporary spacing |
| `Compact.docx` | Denser layout |

Replace these with your real Word templates anytime. Filename (without extension) becomes the display name (e.g. `Senior-Engineer.docx` → “Senior Engineer”).

## Placeholder IDs

Use these tokens in your Word template (formatting on the token is preserved):

| Token | Source |
|-------|--------|
| `{{Full Name}}` | Profile |
| `{{Role}}` | Profile |
| `{{Location}}` | Profile |
| `{{Phone}}` | Profile |
| `{{Email}}` | Profile |
| `{{LinkedIn}}` | Profile |
| `{{Summary}}` | Resume content under **PROFESSIONAL SUMMARY** |
| `{{Skill Set}}` | Resume content under **SKILL SET** |
| `{{Certification}}` | Resume content under **CERTIFICATION** |
| `{{Company Role}}` | Profile experience (matched to `TITLE:`) |
| `{{Company Name}}` | Profile experience |
| `{{Work Period}}` | Profile experience |
| `{{Company Bullet}}` | Resume content under each `TITLE:` |
| `{{University}}` | Profile education. The education block is repeated once per education entry. |
| `{{Degree}}` | Profile education |
| `{{University Location}}` | Profile education |
| `{{Education Period}}` | Profile education |

The experience block (`Company Role` / `Company Name` / `Work Period` / `Company Bullet`) is duplicated once per `TITLE:` section. Use this with **Structure 1** profiles.

## Structure 2 placeholders

Choose **Structure 2** on the profile when company, role, and location are written in the resume content instead of the profile. Header, summary, skills, education, and certification tokens stay the same.

Put this experience block in the template. The first half is used for the latest company. The second half is repeated for each earlier company.

```
{{Company Name}}    {{Work Period}}
{{Company Role}}    {{COMPANY_LOCATION}}
{{@DETAILS}}
{{@PROJECT}}
{{@PROJECT_DETAILS}}
{{Company Name}}    {{Work Period}}
{{Company Role}}    {{COMPANY_LOCATION}}
{{@DETAILS}}
```

| Token | Latest company | Earlier companies |
|-------|----------------|-------------------|
| `{{Company Name}}` | `Company:` line | `Company:` line |
| `{{Work Period}}` | Work period on the profile, same order as the content (latest first) | same |
| `{{Company Role}}` | text after `TITLE:` | text after `TITLE:` |
| `{{COMPANY_LOCATION}}` | `Location:` line | `Location:` line |
| `{{@DETAILS}}` | summary line, then the lines after `PROJECT_END` | every bullet |
| `{{@PROJECT}}` | text after `PROJECT:` (braces around the name are removed) | not used |
| `{{@PROJECT_DETAILS}}` | bullets under that project | not used |

`PROJECT_END` and `EXPERIENCE_END` are markers in the resume content. They are not written into the document.

## Notes

- Project templates cannot be deleted from the UI — remove the file from this folder instead.
- Admins can still upload extra formats from the profile form; those are stored under `server/uploads/formats/`.
- Only `.docx` templates support placeholder filling.
