# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "rich",
#     "ollama",
# ]
# ///
from typing import Union

from rich import print

from ollama import WebFetchResponse, WebSearchResponse, chat, web_fetch, web_search

available_tools = {'web_search': web_search, 'web_fetch': web_fetch}

query = "find who parth sareen is and tell me how many latte art images he has on his website"
print('Query: ', query)

system = "You are in a loop and can make multiple tool calls to reach your goal. You can also pass the result of a tool call to the next tool call."
messages = [{'role': 'system', 'content': system}, {'role': 'user', 'content': query}]
while True:
  response = chat(model='qwen3-coder:480b-cloud', messages=messages, tools=[web_search, web_fetch], think=True)
  if response.message.thinking:
    print('Thinking: ')
    print(response.message.thinking + '\n\n')
  if response.message.content:
    print('Content: ')
    print(response.message.content + '\n')

  messages.append(response.message)

  if response.message.tool_calls:
    for tool_call in response.message.tool_calls:
      function_to_call = available_tools.get(tool_call.function.name)
      if function_to_call:
        args = tool_call.function.arguments
        result: Union[WebSearchResponse, WebFetchResponse] = function_to_call(**args)
        print('Result from tool call name:', tool_call.function.name, 'with arguments:')
        print(args)
        print()

        print(str(result)[:300])
        print()

        messages.append({'role': 'tool', 'content': str(result), 'tool_name': tool_call.function.name})
      else:
        print(f'Tool {tool_call.function.name} not found')
        messages.append({'role': 'tool', 'content': f'Tool {tool_call.function.name} not found', 'tool_name': tool_call.function.name})
  else:
    # no more tool calls, we can stop the loop
    break