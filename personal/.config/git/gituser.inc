[user]
    email = your-personal-email@example.com
    name = Your Personal Name

[includeIf "gitdir:~/repos/foss/"]
	path = ./git-foss.inc
[includeIf "gitdir:~/repos/ti_padc/"]
	path = ./git-ti.inc