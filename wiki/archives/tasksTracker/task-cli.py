import json
import sys
from datetime import datetime


tasks = []

def load_file():
    with open('tasks.json','r') as f:
        tasks = json.load(f)
    return tasks

def dump_file(tasks):
    with open('tasks.json','w') as f:
        json.dump(tasks,f,indent=2)


def create_task(time,content):
    with open('tasks.json','r') as f:
        task={}
        tasks = json.load(f)
        task["created_at"]=time
        task["content"]=content
        task['status']='in_progress'
        task['head']=max(task['head'] for task in tasks)+1 if tasks else 1
        tasks.append(task)
    with open('tasks.json','w') as f:
        json.dump(tasks,f,indent=2)
        
        
    
def update_task(head,time,content):
    with open('tasks.json','r') as f:
        tasks=json.load(f)
        for task in tasks:
            if task["head"]==head:
                task['updated_at']=time
                task['content']=content
                break
    with open('tasks.json','w') as f:
        json.dump(tasks,f,indent=2)
        
def delete_task(head):
    with open('tasks.json','r') as f:
        tasks = json.load(f)
        tasks = [task for task in tasks if task['head'] != head]
    with open('tasks.json','w') as f:
        json.dump(tasks,f,indent=2)
        
def list_tasks(status):
    with open('tasks.json','r') as f:
        tasks = json.load(f)
        for task in tasks:
            if status is None or task['status']==status:
                print(task['head'],task['content'])
           
msg = sys.argv

if msg[1] == 'create':
    create_task(datetime.now().isoformat(),msg[2])
elif msg[1] =='update':
    update_task(int(msg[2]),datetime.now().isoformat(),msg[3])
elif msg[1] =='delete':
    delete_task(int(msg[2]))
elif msg[1] == 'list':
    if(len(sys.argv)>2):
        status = sys.argv[2]
        list_tasks(status)
    else:
        list_tasks(status=None)
    

    

        