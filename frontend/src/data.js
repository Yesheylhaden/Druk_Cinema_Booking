import dorozamPoster from '../image/1.jpg';
import nabaShoPoster from '../image/6.jpg';
import fearlessPoster from '../image/7.jpg';
import samsaraPoster from '../image/9.jpg';
import poster5 from '../image/5.jpg';
import poster13 from '../image/13.jpg';
import lekzinPoster from '../image/3.jpg';
import azaiDhreyPoster from '../image/2.jpg';
import chasingStarsPoster from '../image/12.jpg';
import returnPoster from '../image/10.jpg';
import phushayPoster from '../image/4.jpg';
import amaPoster from '../image/8.jpg';
export const demoMovies=[
{id:1,title:'Lekzin',year:2024,genres:['Drama','Thriller'],duration:126,rating:4.9,poster:'mountains',description:'Four lives. One secret. A story of family, loyalty, and finding the way home.'},
{id:2,title:'Azai Dhrey',year:2023,genres:['Comedy'],duration:113,rating:4.7,poster:'city',description:'An unexpected encounter turns an ordinary day into a beautifully chaotic adventure.'},
{id:3,title:'Chasing Stars',year:2025,genres:['Romance','Drama'],duration:108,rating:4.8,poster:'flowers',description:'Two dreamers discover that the best journeys are shared.'},
{id:4,title:'The Return',year:2024,genres:['Action','Thriller'],duration:118,rating:4.5,poster:'temple',description:'A prince returns to a divided kingdom, where old loyalties face a new test.'},
{id:5,title:'Phushay',year:2023,genres:['Comedy','Romance'],duration:109,rating:4.6,poster:'valley',description:'A little misunderstanding. A big-hearted romance. A night to remember.'},
{id:6,title:'Ama',year:2025,genres:['Drama'],duration:102,rating:4.8,poster:'home',description:'A portrait of motherhood and the quiet courage that holds a family together.'}
,
{id:7,title:'Dorozam',year:null,genres:[],duration:null,rating:null,poster:'dorozam',description:'Added from your poster collection. Release details, genre, and runtime are awaiting confirmation. Showtimes are sample demo screenings.',is_new:true,listing_status:'now_showing'},
{id:8,title:'Naba Sho',year:null,genres:[],duration:null,rating:null,poster:'nabasho',description:'Come Me Tomorrow. Added from your supplied poster. Release details and runtime are awaiting confirmation. Showtimes are sample demo screenings.',is_new:true,listing_status:'now_showing'},
{id:9,title:'The Fearless',year:null,genres:[],duration:null,rating:null,poster:'fearless',description:'Added from your supplied poster. Screening details are not yet scheduled in this demo.',is_new:true,listing_status:'awaiting_schedule'},
{id:10,title:'Samsara',year:null,genres:[],duration:null,rating:null,poster:'samsara',description:'A Bhutanese Tale. Added from your poster collection. Screening details are awaiting confirmation.',is_new:true,listing_status:'awaiting_schedule'},
{id:11,title:'Title to be confirmed',year:null,genres:[],duration:null,rating:null,poster:'poster5',description:'From your supplied 5.jpg poster. English title and screening details are awaiting confirmation.',is_new:true,listing_status:'awaiting_schedule'},
{id:12,title:'Title to be confirmed',year:null,genres:[],duration:null,rating:null,poster:'poster13',description:'From your supplied 13.jpg poster. English title and screening details are awaiting confirmation.',is_new:true,listing_status:'awaiting_schedule'}
];
export const images={
  mountains:lekzinPoster,
  city:azaiDhreyPoster,
  flowers:chasingStarsPoster,
  temple:returnPoster,
  valley:phushayPoster,
  home:amaPoster,dorozam:dorozamPoster,nabasho:nabaShoPoster,fearless:fearlessPoster,samsara:samsaraPoster,poster5,poster13
};