
Backup gene is an application that runs on user desktop and uses robocopy to copy source folder to a destination folders configured by user. 

### Requirements

#### FR1 - Configuration UI 
 - Configure many source and destination folders
 - For each source/destination configure robocopy options
 - Robocopy options are configured using check box and input if required by robocopy option 
	 - examples:
		 - /s 
		 - /j 
		 - /mt:128 
		 - /xj 
		 - /xjd 
		 - /xjf 
		 - /tee 
		 - /xd "C:\$Recycle.Bin" /xd "C:\System Volume Information" 
		 - /log:robocopy-backup-logs/robocopy-backup-cuser.log

#### FR2 - Running Robocopy
- UI
	- List configured robocopy tasks
	- Execute task:
		- run robocopy instance as separate process
		- make process visible for users to monitor
	- Track:
		- Last time task was executed
		- Extract robocopy run summary
		- Keep summaries until user deletes or time expires
	
