from flask import Flask,request,render_template,jsonify,send_from_directory
import requests
import json
from flask import Flask
from flask_cors import CORS

app = Flask(__name__,static_url_path='',static_folder='static')
CORS(app)


key_ticketMaster = ''
loc_key = ''
google_api = ''
api_url = 'https://app.ticketmaster.com/discovery/v2/events.json?apikey=' + key_ticketMaster + '&'

@app.route('/get_search_results', methods=['GET'])
def search():    
    keyword = request.args['keyword']
    distance = request.args['distance']
    segmentID = request.args['segmentID']
    geoHash = request.args['geoHash']
    geoHash = geoHash[0:6]

    stri = api_url + 'keyword=' + keyword + '&segmentID=' + segmentID + '&radius=' + str(distance) + '&unit=miles&geoPoint=' + geoHash
    response = requests.get(stri)
    data = response.json()
    response_dump = json.dumps(data)
    response_load = json.loads(response_dump)

    key = '_embedded'

    size = data['page']['size']
    
    if key in data.keys():
        ret = {}
        temp_list = []
        data2 = data[key]['events']
        
        for event in data2:
            temp = {}
            temp['id'] = event['id']
            temp['date'] = event['dates']['start']['localDate']
            if 'localTime' in event['dates']['start'].keys():
                temp['time'] = event['dates']['start']['localTime']
            temp['icon'] = event['images'][0]['url']
            temp['event'] = event['name']
            temp['genre'] = event['classifications'][0]['segment']['name']
            temp['venue'] = event['_embedded']['venues'][0]['name']

            temp_list.append(temp)

        ret['events'] = temp_list
        return ret
    else:
        return {'events': 0}

@app.route('/get_card1', methods=['GET'])
def card1():
    id = request.args['id']
    s = 'https://app.ticketmaster.com/discovery/v2/events/' + id + '?apikey=' + key_ticketMaster + '&'

    response = requests.get(s)
    data = response.json()
    response_dump = json.dumps(data)
    response_load = json.loads(response_dump)


    key = 'name'

    if key in data.keys():
        ret = {}
        temp_list = []

        # Title
        ret['title'] = data['name']
        # Date
        ret['date'] = data['dates']['start']['localDate'] 
        # Time
        if 'localTime' in data['dates']['start'].keys(): 
            ret['time'] = data['dates']['start']['localTime']
        # Artist/Team
        if 'attractions' in data['_embedded'].keys():
            ret['artist_team'] = data['_embedded']['attractions'][0]['name']
        ret['url'] = data['url']
        # Venue
        ret['venue'] = data['_embedded']['venues'][0]['name']
        # Genre
        g = ""
        if 'segment' in data['classifications'][0].keys() and data['classifications'][0]['segment']['name'] != "Undefined":
            g += data['classifications'][0]['segment']['name']
        if 'genre' in data['classifications'][0].keys() and data['classifications'][0]['genre']['name'] != "Undefined":
            g += ' | ' + data['classifications'][0]['genre']['name']
        if 'subGenre' in data['classifications'][0].keys() and data['classifications'][0]['subGenre']['name'] != "Undefined":
            g += ' | ' + data['classifications'][0]['subGenre']['name']
        if 'type' in data['classifications'][0].keys() and data['classifications'][0]['type']['name'] != "Undefined":
            g += ' | ' + data['classifications'][0]['type']['name']
        if 'subType' in data['classifications'][0].keys() and data['classifications'][0]['subType']['name'] != "Undefined":
            g += ' | ' + data['classifications'][0]['subType']['name']
        ret['genre'] = g
        # Price Ranges
        if 'priceranges' in data.keys():
            p = str(data['priceRanges'][0]['min']) + '-' + str(data['priceRanges'][0]['max']) + ' ' + data['priceRanges'][0]['currency']
            ret['price_ranges'] = p
        # Ticket Status
        ret['ticket_status'] = data['dates']['status']['code']
        # Buy Ticket At
        ret['buy_ticket_at'] = data['url']
        # Seat Map
        if 'seatmap' in data.keys():
            ret['seat_map'] = data['seatmap']['staticUrl']

        temp_list = []
        t = {}
        temp_list.append(ret)
        t['card1'] = temp_list
        return t
    
@app.route('/get_card2', methods=['GET'])
def card2():
    keyword = request.args['keyword']
    s = 'https://app.ticketmaster.com/discovery/v2/venues?apikey=' + key_ticketMaster + '&keyword=' + keyword
    response = requests.get(s)
    data = response.json()
    response_dump = json.dumps(data)
    response_load = json.loads(response_dump)
    if "_embedded" in data.keys():
        ret = {}
        temp_list = []
        
        # Title
        ret['venue'] = data['_embedded']['venues'][0]['name']

        # Logo
        if 'images' in data['_embedded']['venues'][0].keys(): 
            ret['logo'] = data['_embedded']['venues'][0]['images'][0]['url']
        else:
            ret['logo'] = 'nologo'

        # Address
        if 'address' in data['_embedded']['venues'][0].keys():
            ret['address'] = data['_embedded']['venues'][0]['address']['line1'] 

        # City
        if 'city' in data['_embedded']['venues'][0]:
            ret['city'] = data['_embedded']['venues'][0]['city']['name']

        # StateCode
        if 'state' in data['_embedded']['venues'][0].keys() and 'stateCode' in data['_embedded']['venues'][0]['state'].keys():
            ret['stateCode'] = data['_embedded']['venues'][0]['state']['stateCode']

        # Postal Code
        if 'postalCode' in data['_embedded']['venues'][0].keys(): 
            ret['postal_code'] = data['_embedded']['venues'][0]['postalCode']

        # Upcoming Events
        if 'url' in data['_embedded']['venues'][0].keys(): 
            ret['url'] = data['_embedded']['venues'][0]['url']

        # Google Map Location 
        ret['map'] = 'https://www.google.com/maps/search/?api=' + google_api + '&query=' + ret['venue']
        return ret

@app.route('/')
def hello():
    return app.send_static_file('index.html')

if __name__=='__main__':
    app.run(debug=True)