[user]
    email = your-work-email@company.com
    name = Your Work Name

[includeIf "gitdir:~/repos/foss/"]
	path = ./git-foss.inc
[includeIf "gitdir:~/repos/ti_padc/"]
	path = ./git-ti.inc